import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from'@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

export default {
  input:'src/index.js',
  output: [
    {
      file: 'dist/index.cjs.js',
      format:'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format:'es',
      sourcemap: true
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    json(),
    terser()
  ]
};
