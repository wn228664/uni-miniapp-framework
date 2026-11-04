/** 检查手写 JS 和 Vue；uni/getCurrentPages 为平台只读全局，布局排版交给 Prettier，保留语义与未使用符号检查。 */
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, uni: 'readonly', getCurrentPages: 'readonly' },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
    },
  },
]
