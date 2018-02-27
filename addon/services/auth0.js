import Ember from 'ember';
import Auth0 from 'auth0';
import Auth0Lock from 'auth0-lock';
import Auth0LockPasswordless from 'auth0-lock-passwordless';
import createSessionDataObject from '../utils/create-session-data-object';
import { Auth0Error } from '../utils/errors'

const {
  Service,
  computed,
  computed: {
    readOnly,
  },
  get,
  getOwner,
  getProperties,
  assert,
  testing,
  isEmpty,
  inject: {
    service
  },
  RSVP,
} = Ember;

const validPasswordlessTypes = [
  'sms',
  'magiclink',
  'emailcode',
  'socialOrMagiclink'
];

export default Service.extend({
  session: service(),
  /**
   * The env config found in the environment config.
   * ENV['ember-simple-auth'].auth0
   *
   * @type {Object}
   */
  config: computed({
    get() {
      const emberSimpleAuthConfig = get(this, '_environmentConfig')['ember-simple-auth'];
      assert('ember-simple-auth config must be defined', emberSimpleAuthConfig);
      assert('ember-simple-auth.auth0 config must be defined', emberSimpleAuthConfig.auth0);

      return emberSimpleAuthConfig.auth0;
    }
  }),

  /**
   * The Auth0 App ClientID found in your Auth0 dashboard
   * @type {String}
   */
  clientID: readOnly('config.clientID'),

  /**
   * The Auth0 App Domain found in your Auth0 dashboard
   * @type {String}
   */
  domain: readOnly('config.domain'),

  logoutReturnToURL: readOnly('config.logoutReturnToURL'),

  showLock(options, clientID = null, domain = null) {
    return new RSVP.Promise((resolve, reject) => {
      const lock = this.getAuth0LockInstance(options, clientID, domain);
      this._setupLock(lock, resolve, reject);
      lock.show();
    });
  },

  showPasswordlessLock(type, options, clientID = null, domain = null) {
    assert(`You must pass in a valid type to auth0-lock-passwordless authenticator. Valid types: ${validPasswordlessTypes.toString()}`,
      validPasswordlessTypes.indexOf(type) > -1);

    return new RSVP.Promise((resolve) => {
      const lock = this.getAuth0LockPasswordlessInstance(clientID, domain);
      lock[type](options, (...args) => resolve(...args));
    });
  },

  _setupLock(lock, resolve, reject) {
    lock.on('unrecoverable_error', reject);
    lock.on('authorization_error', reject);

    // lock.on('hash_parsed', resolve);
    lock.on('authenticated', (authenticatedData) => {
      if (isEmpty(authenticatedData)) {
        return reject(new Auth0Error('The authenticated data did not come back from the request'));
      }
      
      const issuedAt = Math.ceil(Date.now() / 1000);

      lock.getUserInfo(authenticatedData.accessToken, (error, profile) => {
        if (error) {
          return reject(new Auth0Error(error));
        }

        resolve(createSessionDataObject(authenticatedData, profile, issuedAt));
      });
    });
  },

  getAuth0LockInstance(options, clientID = null, domain = null) {
    clientID = clientID || get(this, 'clientID');
    domain = domain || get(this, 'domain');
    const Auth0LockConstructor = get(this, '_auth0Lock');

    return new Auth0LockConstructor(clientID, domain, options);
  },

  getAuth0Instance(clientID = null, domain = null) {
    clientID = clientID || get(this, 'clientID');
    domain = domain || get(this, 'domain');

    const Auth0Constructor = get(this, '_auth0.WebAuth');

    return new Auth0Constructor({
      domain,
      clientID
    });
  },

  getAuth0LockPasswordlessInstance(clientID = null, domain = null) {
    clientID = clientID || get(this, 'clientID');
    domain = domain || get(this, 'domain');
    const Auth0LockPasswordlessConstructor = get(this, '_auth0LockPasswordless');

    return new Auth0LockPasswordlessConstructor(clientID, domain);
  },

  navigateToLogoutURL() {
    const {
      domain,
      logoutReturnToURL,
      clientID
    } = getProperties(this, 'domain', 'logoutReturnToURL', 'clientID');

    if (!testing) {
      window.location.replace(`https://${domain}/v2/logout?returnTo=${logoutReturnToURL}&client_id=${clientID}`);
    }
  },

  logout() {
    get(this, 'session').invalidate().then(this.navigateToLogoutURL.bind(this));
  },

  _auth0: computed(function() {
    return Auth0;
  }),

  _auth0Lock: computed(function() {
    return Auth0Lock;
  }),

  _auth0LockPasswordless: computed(function() {
    return Auth0LockPasswordless;
  }),

  _environmentConfig: computed({
    get() {
      return getOwner(this).resolveRegistration('config:environment');
    }
  }),
});
