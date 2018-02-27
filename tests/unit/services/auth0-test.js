import Ember from 'ember';
import test from 'ember-sinon-qunit/test-support/test';
import sinon from 'sinon';
import createSessionDataObject from 'ember-simple-auth-auth0/utils/create-session-data-object';

import {
  moduleFor,
} from 'ember-qunit';

const {
  get,
  set,
  Evented,
} = Ember;

const assign = Ember.assign || Ember.merge;

const StubLock = Ember.Object.extend(Evented, {
  profile: null,
  shouldThrowGetUserInfoError: false,
  getUserInfo(idToken, callback) {
    if (get(this, 'shouldThrowGetUserInfoError')) {
      callback(new Error('failed to get profile'));
    } else {
      callback(null, get(this, 'profile'));
    }
  },
  show: sinon.stub(),
  sms: sinon.stub(),
  magiclink: sinon.stub(),
  emailcode: sinon.stub(),
});

moduleFor('service:auth0', 'Unit | Service | auth0', {
  // Specify the other units that are required for this test.
  needs: ['service:session'],
  registerConfig(config) {
    const defaultConfig = {
      rootURL: '/test',
      ['ember-simple-auth']: {
        auth0: {}
      }
    };

    config = assign(defaultConfig, config);
    this.register('config:environment', config);
    return config;
  },
  stubLock(stubbedLock) {
    stubbedLock = stubbedLock || new StubLock();
    return this.stub().returns(stubbedLock);
  },
  windowLocation() {
    return [
      window.location.protocol,
      '//',
      window.location.host,
    ].join('');
  }
});

test('it calculates the logoutURL correctly giving logoutReturnToURL precedence', function(assert) {
  const config = this.registerConfig({
    ['ember-simple-auth']: {
      auth0: {
        logoutReturnToURL: `${this.windowLocation()}/my-login`
      }
    }
  });

  let service = this.subject();
  assert.equal(get(service, 'logoutReturnToURL'),
    config['ember-simple-auth'].auth0.logoutReturnToURL);
});

test('showPasswordlessLock throws an error when the wrong type is passed in', function(assert) {
  assert.expect(1);
  this.registerConfig();
  const subject = this.subject();
  assert.throws(() => subject.showPasswordlessLock());
});

test('showPasswordlessLock assigns options', function(assert) {
  assert.expect(1);
  this.registerConfig();
  const subject = this.subject({
    getAuth0LockPasswordlessInstance: this.stubLock()
  });

  const options = {
    auth: {
      params: {
        scope: 'openid user_id'
      },
    },
  };

  subject.showPasswordlessLock('sms', options);

  assert.ok(subject.getAuth0LockPasswordlessInstance().sms.calledWith(options));
});

test('showLock calls getUserInfo', function(assert) {
  assert.expect(1);
  const done = assert.async();
  const stubbedLock = new StubLock();
  const profile = {
    user_id: '1',
  };
  const authenticatedData = {
    idToken: '1.2.3',
  };

  const expectedData = createSessionDataObject(authenticatedData, profile);

  set(stubbedLock, 'profile', profile);
  const subject = this.subject({
    getAuth0LockInstance: this.stubLock(stubbedLock)
  });

  subject.showLock()
    .then((data) => assert.deepEqual(data, expectedData))
    .catch(() => assert.notOk(true))
    .finally(done);

  stubbedLock.trigger('authenticated', authenticatedData);
});

test('showLock rejects when receiving an unrecoverable_error', function(assert) {
  assert.expect(1);
  const done = assert.async();
  const stubbedLock = new StubLock();
  const subject = this.subject({
    getAuth0LockInstance: this.stubLock(stubbedLock)
  });

  subject.showLock()
    .then(() => assert.notOk(true))
    .catch(() => assert.ok(true))
    .finally(done);

  stubbedLock.trigger('unrecoverable_error', new Error());
});

test('showLock rejects when receiving an authorization_error', function(assert) {
  assert.expect(1);
  const done = assert.async();
  const stubbedLock = new StubLock();
  const subject = this.subject({
    getAuth0LockInstance: this.stubLock(stubbedLock)
  });

  subject.showLock()
    .then(() => assert.notOk(true))
    .catch(() => assert.ok(true))
    .finally(done);

  stubbedLock.trigger('authorization_error', new Error());
});

test('showLock rejects when authenticatedData does not exist', function(assert) {
  assert.expect(1);
  const done = assert.async();
  const stubbedLock = new StubLock();
  const subject = this.subject({
    getAuth0LockInstance: this.stubLock(stubbedLock)
  });

  subject.showLock()
    .then(() => assert.notOk(true))
    .catch(() => assert.ok(true))
    .finally(done);

  stubbedLock.trigger('authenticated');
});

test('showLock rejects when getUserInfo returns an error', function(assert) {
  assert.expect(1);
  const done = assert.async();
  const stubbedLock = new StubLock({
    shouldThrowGetUserInfoError: true
  });

  const subject = this.subject({
    getAuth0LockInstance: this.stubLock(stubbedLock)
  });

  subject.showLock()
    .then(() => assert.notOk(true))
    .catch(() => assert.ok(true))
    .finally(done);

  stubbedLock.trigger('authenticated', { idToken: '1.2.3' });
});
