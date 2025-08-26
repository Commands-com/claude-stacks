// Custom test sequencer for deterministic test execution
// This ensures unit tests run before integration tests, and integration before e2e

const { TestSequencer } = require('@jest/test-sequencer');

class CustomSequencer extends TestSequencer {
  sort(tests) {
    // Sort tests by type: unit -> integration -> e2e
    const testOrder = {
      'unit': 1,
      'integration': 2,
      'e2e': 3,
    };

    return tests.sort((testA, testB) => {
      const testTypeA = this.getTestType(testA.path);
      const testTypeB = this.getTestType(testB.path);
      
      const orderA = testOrder[testTypeA] || 999;
      const orderB = testOrder[testTypeB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Within the same type, sort alphabetically
      return testA.path.localeCompare(testB.path);
    });
  }

  getTestType(testPath) {
    if (testPath.includes('/unit/')) return 'unit';
    if (testPath.includes('/integration/')) return 'integration';
    if (testPath.includes('/e2e/')) return 'e2e';
    return 'unknown';
  }
}

module.exports = CustomSequencer;