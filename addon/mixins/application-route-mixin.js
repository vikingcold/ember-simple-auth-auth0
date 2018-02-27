import Ember from 'ember';
import ApplicationRouteMixin from 'ember-simple-auth/mixins/application-route-mixin';
import { Auth0Error } from '../utils/errors'

const {
  Mixin,
  computed,
  get,
  getWithDefault,
  set,
  RSVP,
  RSVP: {
    resolve
  },
  inject: {
    service
  },
  run,
  testing,
  isEmpty,
} = Ember;

export default Mixin.create(ApplicationRouteMixin, {
  session: service(),
  auth0: service(),

  sessionAuthenticated() {
    this._setupFutureEvents();
    this._super(...arguments);
  },

  /**
   * Hook that gets called after the jwt has expired
   * but before we notify the rest of the system.
   * Great place to add cleanup to expire any third-party
   * tokens or other cleanup.
   *
   * IMPORTANT: You must return a promise, else logout
   * will not continue.
   *
   * @return {Promise}
   */
  beforeSessionExpired() {
    return resolve();
  },

  /**
   * This has to be overridden because the default behavior prevents
   * auth0 to logout correctly.
   */
  sessionInvalidated() {
    this._clearJobs();
    return this._super(...arguments);
  },

  beforeModel() {
    this._setupFutureEvents();
    let promise = resolve(this._super(...arguments));

    promise = promise
      .then(this._getUrlHashData.bind(this))
      .then(this._authenticateWithUrlHash.bind(this));

    return promise;
  },

  willDestroy() {
    this._clearJobs();
  },

  _authenticateWithUrlHash(urlHashData) {
    if (isEmpty(urlHashData)) {
      return;
    }

    return get(this, 'session').authenticate('authenticator:auth0-url-hash', urlHashData)
      .then(this._clearUrlHash.bind(this));
  },

  _getUrlHashData() {
    const auth0 = get(this, 'auth0').getAuth0Instance();
    return new RSVP.Promise((resolve, reject) => {
      auth0.parseHash((err, parsedPayload) => {
        if (err) {
          return reject(new Auth0Error(err));
        }

        resolve(parsedPayload);
      });
    });
  },

  _clearUrlHash() {
    if(!testing && window.history) {
      window.history.pushState('', document.title, window.location.pathname + window.location.search);
    }
    return RSVP.resolve()
  },

  _setupFutureEvents() {
    // Don't schedule expired events during testing, otherwise acceptance tests will hang.
    if (testing) {
      return;
    }

    this._scheduleExpire();
  },

  _scheduleExpire() {
    run.cancel(get(this, '_expireJob'));
    const expireInMilli = get(this, '_jwtRemainingTimeInSeconds') * 1000;
    const job = run.later(this, this._processSessionExpired, expireInMilli);
    set(this, '_expireJob', job);
  },

  /**
   * The current JWT's expire time
   * @return {Number in seconds}
   */
  _expiresAt: computed('session.data.authenticated', {
    get() {
      if (!get(this, 'session.isAuthenticated')) {
        return 0;
      }

      const expiresIn = getWithDefault(this, 'session.data.authenticated.expiresIn', 0);
      const issuedAt = getWithDefault(this, 'session.data.authenticated.issuedAt', 0);

      return expiresIn + issuedAt;
    }
  }),

  _jwtRemainingTimeInSeconds: computed('_expiresAt', {
    get() {
      const remaining = getWithDefault(this, '_expiresAt', 0) - Math.ceil(Date.now() / 1000);

      return remaining < 0 ? 0 : remaining;
    }
  }),

  _clearJobs() {
    run.cancel(get(this, '_expireJob'));
  },

  _processSessionExpired() {
    return this.beforeSessionExpired()
      .then(this._invalidateIfAuthenticated.bind(this));
  },

  _invalidateIfAuthenticated() {
    let session = get(this, 'session');

    if (get(session, 'isAuthenticated')) {
      session.invalidate();
    }
  }
});
