// Copyright IBM Corp. 2016,2018. All Rights Reserved.
// Node module: loopback-datasource-juggler
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const bdd = require('../helpers/bdd-if');
const should = require('should');
const helpers = require('./_helpers');

module.exports = function(dataSourceFactory, connectorCapabilities) {
  const TTL_PRECISION = connectorCapabilities.ttlPrecision;

  // Use ~1s for stores with precision of 1 ms,
  // about 3s for stores with precision of 1s.
  const INITIAL_TTL = Math.max(TTL_PRECISION + 1000, TTL_PRECISION * 3);

  // A small delay to allow the backend to process the request, run any
  // TTL/expire checks, etc. Use 1ms for backends supporting sub-10ms
  // resolution to ensure the delay is not too short..
  const SMALL_DELAY = Math.max(1, Math.floor(TTL_PRECISION / 10));

  const canQueryTtl = connectorCapabilities.canQueryTtl !== false;

  bdd.describeIf(canQueryTtl, 'ttl', function() {
    let CacheItem;
    beforeEach(setupCacheItem);

    it('gets TTL when key with unexpired TTL exists - Promise API',
      function() {
        return Promise.resolve(
          CacheItem.set('a-key', 'a-value', {ttl: INITIAL_TTL}),
        )
          .then(() => helpers.delay(SMALL_DELAY))
          .then(function() { return CacheItem.ttl('a-key'); })
          .then(function(ttl) { ttl.should.be.within(1, INITIAL_TTL); });
      });

    it('gets TTL when key with unexpired TTL exists - Callback API',
      function(done) {
        CacheItem.set('a-key', 'a-value', {ttl: INITIAL_TTL}, function(err) {
          if (err) return done(err);
          CacheItem.ttl('a-key', function(err, ttl) {
            if (err) return done(err);
            ttl.should.be.within(1, INITIAL_TTL);
            done();
          });
        });
      });

    it('succeeds when key without TTL exists', function() {
      return CacheItem.set('a-key', 'a-value')
        .then(function() { return CacheItem.ttl('a-key'); })
        .then(function(ttl) { should.not.exist(ttl); });
    });

    it('fails when getting TTL for a key with expired TTL', function() {
      return Promise.resolve(
        CacheItem.set('expired-key', 'a-value', {ttl: TTL_PRECISION}),
      )
        .then(() => helpers.delay(2 * TTL_PRECISION))
        .then(function() {
          return CacheItem.ttl('expired-key');
        })
        .then(
          function() { throw new Error('ttl() should have failed'); },
          function(err) {
            err.message.should.match(/expired-key/);
            err.should.have.property('statusCode', 404);
          },
        );
    });

    it('fails when key does not exist', function() {
      return CacheItem.ttl('key-does-not-exist').then(
        function() { throw new Error('ttl() should have failed'); },
        function(err) {
          err.message.should.match(/key-does-not-exist/);
          err.should.have.property('statusCode', 404);
        },
      );
    });

    function setupCacheItem() {
      return helpers.givenCacheItem(dataSourceFactory)
        .then(ModelCtor => CacheItem = ModelCtor);
    }
  });
};
