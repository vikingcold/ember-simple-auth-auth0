import Ember from 'ember';
const assign = Ember.assign || Ember.merge;

export default function createSessionDataObject(tokenInfo, profile, issuedAt) {
  return assign(tokenInfo, { profile, issuedAt });
}
