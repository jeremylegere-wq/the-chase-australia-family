const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),root=process.argv[2];
const memory={};
const localStorage={getItem:k=>memory[k]||null,setItem:(k,v)=>{memory[k]=v;},removeItem:k=>{delete memory[k];}};
const document={getElementById:()=>null,addEventListener:()=>{}};
const window={confirm:()=>true};
vm.runInNewContext(fs.readFileSync(path.join(root,"js/family-records.js"),"utf8"),{window,document,localStorage,Date,Math,Set,Object,String,Array,Number,JSON});
const api=window.ChaseFamilyRecords;
const match={matchId:"m16-test-001",mode:"cooperative",teamBank:12000,players:[
{name:"Alex",correctAnswers:12,incorrectAnswers:2,contribution:12000},
{name:"Sam",correctAnswers:10,incorrectAnswers:4,contribution:10000}
],finalChase:{completed:true,outcome:"contestants_win",contestantScore:12,chaserScore:8}};
const first=api.recordMatch(match);
assert.strictEqual(first.recorded,true);
assert.strictEqual(first.participants.length,2);
assert(first.participants[0].newAchievements.includes("first_win"));
assert(first.participants[0].newAchievements.includes("team_win"));
assert.strictEqual(api.load().profiles.alex.matches,1);
assert.strictEqual(api.load().profiles.alex.correct,12);
assert.strictEqual(api.load().recentMatches[0].prize,12000);
assert.strictEqual(api.recordMatch(match).duplicate,true);
assert.strictEqual(api.load().completedMatchIds.length,1);
const second={...match,matchId:"m16-test-002",mode:"competitive",finalChase:{...match.finalChase,outcome:"chaser_wins"}};
api.recordMatch(second);
assert.strictEqual(api.load().profiles.alex.matches,2);
assert.strictEqual(api.load().profiles.alex.losses,1);
assert.strictEqual(api.reset(),true);
assert.strictEqual(Object.keys(api.load().profiles).length,0);
console.log("M16 records passed: persistent profiles, career totals, wins/losses, achievements, recent results and duplicate protection.");
