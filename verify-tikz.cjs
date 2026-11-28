const assert = require("node:assert/strict");
const { render } = require("../tikz.cjs");

async function verify() {
  const source = String.raw`\begin{tikzpicture}
    \shade[ball color=black!65] (0,0) circle (1cm);
    \draw[decorate,decoration={zigzag}] (1,0) -- (2,0);
    \node[above,font=\bfseries] at (0,1) {Nhiệt lượng kế};
    \node[right] at (2,0) {Dây điện trở};
  \end{tikzpicture}`;
  const result = await render(source, "decorations.pathmorphing");
  const svg = Buffer.from(result.data, "base64").toString("utf8");
  assert.match(svg, /<svg\b/);
  assert.match(svg, /<path\b/);
  assert.doesNotMatch(svg, /<text\b/, "Nhãn cần hiển thị cả khi thiết bị thiếu phông TeX.");
  console.log("PASS TikZ, Vietnamese labels and standalone SVG.");
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
