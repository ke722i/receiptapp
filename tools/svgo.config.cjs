// アイコン SVG の軽量化の設定（docs/icons.md）。見た目をなるべく変えず、桁数とメタ情報を減らす
module.exports = {
  floatPrecision: 1,
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
    'removeDimensions',
  ],
};
