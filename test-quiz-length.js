const fs = require('fs');
const vm = require('vm');

const context = {
  console,
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  window: { scrollTo: () => {} },
  document: {
    getElementById: () => ({
      textContent: '',
      style: {},
      classList: { toggle: () => {}, add: () => {}, remove: () => {} },
      innerHTML: '',
      append: () => {},
      appendChild: () => {},
      querySelector: () => ({
        onchange: null,
        disabled: false,
        style: {},
        classList: { add: () => {}, remove: () => {} },
        oninput: null,
        value: ''
      }),
      value: '',
      focus: () => {},
      disabled: false,
      placeholder: '',
      dataset: {},
      onclick: null
    }),
    querySelectorAll: () => [],
    createElement: () => ({
      style: { setProperty: () => {} },
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      append: () => {},
      appendChild: () => {},
      querySelector: () => ({
        onchange: null,
        disabled: false,
        style: {},
        classList: { add: () => {}, remove: () => {} },
        oninput: null,
        value: ''
      }),
      innerHTML: '',
      textContent: '',
      onclick: null,
      disabled: false,
      dataset: {},
      setAttribute: () => {},
      addEventListener: () => {},
      value: '',
      focus: () => {}
    }),
    body: {},
    addEventListener: () => {}
  },
  fetch: async () => ({ ok: true }),
  setTimeout,
  clearTimeout
};
context.window.document = context.document;

vm.createContext(context);
vm.runInContext(fs.readFileSync('questions.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('script.js', 'utf8'), context);

const D = vm.runInContext('D', context);
const randomizeTopicQuestions = vm.runInContext('randomizeTopicQuestions', context);
const randomizeSubjectQuestions = vm.runInContext('randomizeSubjectQuestions', context);

const topicQuiz = randomizeTopicQuestions(D.math.topics[0]);
if (topicQuiz.length !== 10) {
  console.error('FAIL: topic quiz length is', topicQuiz.length, 'expected 10');
  process.exit(1);
}

const subjectQuiz = randomizeSubjectQuestions('math', 10);
if (subjectQuiz.length !== 10) {
  console.error('FAIL: subject quiz length is', subjectQuiz.length, 'expected 10');
  process.exit(1);
}

console.log('PASS: all quizzes are 10 questions long');
