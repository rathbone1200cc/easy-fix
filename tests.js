/* globals describe, beforeEach, afterEach, it */
'use strict';

const sinon = require('sinon');
const domain = require('domain');
const expect = require('chai').expect;
const easyFix = require('./index');

const expectedReturnValue = 'I am a function return value';
const thingToTest = {
  state: 0,
  incStateAsync: (stateArg, callback) => {
    thingToTest.state = stateArg.val;
    process.nextTick(() => {
      thingToTest.state += 1;
      callback(null, thingToTest.state);
    });
    return expectedReturnValue;
  },
  resetState: () => {
    thingToTest.state = 0;
  }
};

let easyFixStub;
const runSharedTests = (expectTargetFnCalls) => {

  it('falls back onto wrapped method', (done) => {
    const foundReturnValue = thingToTest.incStateAsync({ val: 9 }, (err, state) => {
      expect(foundReturnValue).to.equal(expectedReturnValue);
      expect(state).to.equal(10);
      const expectedTargetState = expectTargetFnCalls ? 10 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

  it('works with mulitple calls', (done) => {
    const firstReturned = thingToTest.incStateAsync({
      val: 98
    }, (firstErr, stateAfterFirstInc) => {
      const secondReturned = thingToTest.incStateAsync({
        val: stateAfterFirstInc
      }, (secondErr, stateAfterSecondInc) => {
        expect(firstReturned).to.equal(expectedReturnValue);
        expect(secondReturned).to.equal(expectedReturnValue);
        expect(stateAfterSecondInc).to.equal(100);
        const expectedTargetState = expectTargetFnCalls ? 100 : 0;
        expect(thingToTest.state).to.equal(expectedTargetState);
        expect(easyFixStub.callCount).to.equal(2);
        done();
      });
    });
  });

  it('works with circular references', (done) => {
    const testObj = { val: 0 };
    testObj.circ = testObj; // add circular reference
    thingToTest.incStateAsync(testObj, (err, state) => {
      expect(state).to.equal(1);
      const expectedTargetState = expectTargetFnCalls ? 1 : 0;
      expect(thingToTest.state).to.equal(expectedTargetState);
      expect(easyFixStub.callCount).to.equal(1);
      done();
    });
  });

};

// The call to incStateAsync includes a parameter (val)
// that sets the state, but that won't happen when the
// method is wrapped and called in reply mode.
// So we reset the state with resetState before each test.
beforeEach(() => { thingToTest.resetState(); });

describe('wrapAsyncMethod (live mode)', () => {
  beforeEach(() => {
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateAsync', {
      mode: 'live',
      sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(true);
});

describe('wrapAsyncMethod (capture mode)', () => {
  beforeEach(() => {
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateAsync', {
      mode: 'capture',
      sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(true);
});

describe('wrapAsyncMethod (replay mode)', () => {
  beforeEach(() => {
    easyFixStub = easyFix.wrapAsyncMethod(thingToTest, 'incStateAsync', {
      mode: 'replay',
      sinon,
      dir: 'tmp'
    });
  });
  afterEach(() => {
    easyFixStub.restore();
  });

  runSharedTests(false);

  describe('if no matching mock data is found', () => {
    const fnWithoutMocks = (cb) => {
      thingToTest.incStateAsync({
        foo: 'bar'
      }, () => { cb(new Error('Failed to throw')); });
    };

    it('should throw an error with details about the expected data', (done) => {
      expect(() => fnWithoutMocks(done)).to.throw();
      done();
    });
  });
});
