import Ember from 'ember';
import Auth0BaseAuthenticator from 'ember-simple-auth-auth0/authenticators/auth0-base';
import createSessionDataObject from '../utils/create-session-data-object';
import { Auth0Error } from '../utils/errors'

const {
  RSVP,
  get,
  inject: {
    service
  },
  isEmpty,
} = Ember;

export default Auth0BaseAuthenticator.extend({
  auth0: service(),
  session: service(),
  authenticate(urlHashData) {
    const issuedAt = Math.ceil(Date.now() / 1000);

    return new RSVP.Promise((resolve, reject) => {
      if (isEmpty(urlHashData)) {
        reject();
      }
      
      const auth0 = get(this, 'auth0').getAuth0Instance();
      const getUserInfo = auth0.client.userInfo.bind(auth0.client);

      getUserInfo(urlHashData.accessToken, (err, profile) => {
        if (err) {
          return reject(new Auth0Error(err));
        }

        resolve(createSessionDataObject(urlHashData, profile, issuedAt));
      });
    });
  },
});
