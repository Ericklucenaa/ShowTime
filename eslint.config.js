import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error'
    },
    files: ['src/**/*.tsx', 'src/**/*.ts', 'src/**/*.js', 'src/**/*.jsx']
  }
];
