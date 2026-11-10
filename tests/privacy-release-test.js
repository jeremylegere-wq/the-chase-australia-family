const fs=require("fs"),path=require("path"),assert=require("assert");
const root=process.argv[2];
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const field=html.match(/<textarea[^>]*id="tournament-contestants"[^>]*>/);
assert(field,"Tournament contestant field must exist.");
assert(field[0].includes('placeholder="Player 1, Player 2, Player 3, Player 4"'),
  "Tournament contestant placeholder must use generic player labels.");
console.log("Generic contestant placeholder privacy check passed.");
