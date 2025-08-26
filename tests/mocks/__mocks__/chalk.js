// Mock chalk for testing
const createMockChalk = (defaultStyle = text => text) => {
  const chalk = text => defaultStyle(text);

  // Add all chalk methods as passthrough functions
  const methods = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'gray',
    'grey',
    'blackBright',
    'redBright',
    'greenBright',
    'yellowBright',
    'blueBright',
    'magentaBright',
    'cyanBright',
    'whiteBright',
    'bgBlack',
    'bgRed',
    'bgGreen',
    'bgYellow',
    'bgBlue',
    'bgMagenta',
    'bgCyan',
    'bgWhite',
    'bgGray',
    'bgGrey',
    'bgBlackBright',
    'bgRedBright',
    'bgGreenBright',
    'bgYellowBright',
    'bgBlueBright',
    'bgMagentaBright',
    'bgCyanBright',
    'bgWhiteBright',
    'reset',
    'bold',
    'dim',
    'italic',
    'underline',
    'inverse',
    'hidden',
    'strikethrough',
    'visible',
  ];

  methods.forEach(method => {
    chalk[method] = defaultStyle;
  });

  // Support chaining
  methods.forEach(method => {
    Object.defineProperty(chalk, method, {
      get() {
        return chalk;
      },
    });
  });

  return chalk;
};

const mockChalk = createMockChalk();

// Named export for Chalk class
class Chalk {
  constructor() {
    return createMockChalk();
  }
}

// CommonJS export
module.exports = mockChalk;
module.exports.default = mockChalk;
module.exports.Chalk = Chalk;
