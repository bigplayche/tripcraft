/** RLS smoke test. Runs against PGlite in memory by default, or DATABASE_URL if set. */
import { asService, withUser } from "../src/lib/db";

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
};
const denied = async (fn: () => Promise<unknown>) => fn().then(() => false, () => true);

async function main() {
  const tag = Date.now();
  const mk = (n: string) => asService(async (q) => (await q("insert into auth.users (email) values ($1) returning id", [`${n}-${tag}@test.dev`]))[0].id as string);
  const [alice, bob, carol] = [await mk("alice"), await mk("bob"), await mk("carol")];

  check("signup trigger creates profile, prefs, subscription", (await withUser(alice, (q) => q("select 1 from users u join user_preferences p on p.user_id=u.id join subscriptions s on s.user_id=u.id"))).length === 1);

  const tripId = await withUser(alice, async (q) => (await q("insert into trips (owner_id,title,destination_name,start_date,end_date,budget) values ($1,'T','Lisbon','2027-05-01','2027-05-05',2000) returning id", [alice]))[0].id as string);
  check("owner becomes a trip member", (await withUser(alice, (q) => q("select role from trip_members where trip_id=$1", [tripId])))[0]?.role === "owner");
  check("date column parses as string, numeric as number", await withUser(alice, async (q) => { const [t] = await q("select start_date, budget from trips where id=$1", [tripId]); return t.start_date === "2027-05-01" && t.budget === 2000; }));
  check("stranger cannot see the trip", (await withUser(bob, (q) => q("select 1 from trips where id=$1", [tripId]))).length === 0);
  check("user cannot create a trip for someone else", await denied(() => withUser(bob, (q) => q("insert into trips (owner_id,title,destination_name,start_date,end_date,budget) values ($1,'x','x','2027-01-01','2027-01-02',1)", [alice]))));
  check("stranger cannot add an expense", await denied(() => withUser(bob, (q) => q("insert into trip_expenses (trip_id,created_by,category,description,amount) values ($1,$2,'food','x',1)", [tripId, bob]))));
  check("stranger cannot add themselves as a member", await denied(() => withUser(bob, (q) => q("insert into trip_members (trip_id,user_id,role) values ($1,$2,'editor')", [tripId, bob]))));
  check("user cannot upgrade their own subscription", await denied(() => withUser(bob, (q) => q("update subscriptions set plan='pro' where user_id=$1 returning plan", [bob]).then((r) => { if (!r.length) throw new Error("no rows"); }))));
  check("user cannot read another user's subscription", (await withUser(bob, (q) => q("select 1 from subscriptions where user_id=$1", [alice]))).length === 0);
  check("user cannot forge notifications", await denied(() => withUser(bob, (q) => q("insert into notifications (user_id,type,title) values ($1,'x','x')", [alice]))));

  await withUser(alice, (q) => q("insert into trip_invites (trip_id,token,role,created_by) values ($1,$2,'viewer',$3)", [tripId, `tok-${tag}`, alice]));
  await withUser(alice, (q) => q("insert into trip_invites (trip_id,token,role,created_by) values ($1,$2,'editor',$3)", [tripId, `tok-e-${tag}`, alice]));
  check("stranger cannot list invites", (await withUser(bob, (q) => q("select 1 from trip_invites"))).length === 0);
  check("invite preview works by token", (await withUser(bob, (q) => q("select * from peek_invite($1)", [`tok-${tag}`])))[0]?.trip_title === "T");
  check("bad invite token is rejected", await denied(() => withUser(bob, (q) => q("select accept_invite('nope')"))));
  await withUser(bob, (q) => q("select accept_invite($1)", [`tok-${tag}`]));
  await withUser(carol, (q) => q("select accept_invite($1)", [`tok-e-${tag}`]));
  check("viewer can now see the trip", (await withUser(bob, (q) => q("select 1 from trips where id=$1", [tripId]))).length === 1);
  check("viewer cannot edit the trip", (await withUser(bob, (q) => q("update trips set title='hacked' where id=$1 returning id", [tripId]))).length === 0);
  check("viewer cannot add expenses", await denied(() => withUser(bob, (q) => q("insert into trip_expenses (trip_id,created_by,category,description,amount) values ($1,$2,'food','x',1)", [tripId, bob]))));
  check("viewer can suggest an activity", (await withUser(bob, (q) => q("insert into activities (trip_id,name,status,suggested_by,source) values ($1,'Kayak','suggested',$2,'user') returning id", [tripId, bob]))).length === 1);
  check("viewer cannot add a curated activity", await denied(() => withUser(bob, (q) => q("insert into activities (trip_id,name,status,source) values ($1,'x','recommended','user')", [tripId]))));
  check("editor can add expenses", (await withUser(carol, (q) => q("insert into trip_expenses (trip_id,created_by,category,description,amount) values ($1,$2,'food','Dinner',90) returning id", [tripId, carol]))).length === 1);
  check("editor cannot promote themselves", (await withUser(carol, (q) => q("update trip_members set role='owner' where trip_id=$1 and user_id=$2 returning role", [tripId, carol]).catch(() => []))).length === 0);
  check("editor cannot delete the trip", (await withUser(carol, (q) => q("delete from trips where id=$1 returning id", [tripId]))).length === 0);
  const pollId = await withUser(alice, async (q) => (await q(`insert into group_polls (trip_id,created_by,question,options) values ($1,$2,'Dinner?','[{"id":"a","label":"A"},{"id":"b","label":"B"}]'::jsonb) returning id`, [tripId, alice]))[0].id as string);
  await withUser(bob, (q) => q("insert into group_votes (poll_id,trip_id,user_id,option_id) values ($1,$2,$3,'a')", [pollId, tripId, bob]));
  check("viewer can vote", (await withUser(alice, (q) => q("select 1 from group_votes where poll_id=$1", [pollId]))).length === 1);
  check("cannot vote as someone else", await denied(() => withUser(bob, (q) => q("insert into group_votes (poll_id,trip_id,user_id,option_id) values ($1,$2,$3,'b')", [pollId, tripId, carol]))));
  check("members can see each other's profile", (await withUser(bob, (q) => q("select 1 from users where id=$1", [alice]))).length === 1);
  check("owner got a join notification", (await withUser(alice, (q) => q("select 1 from notifications where type='member_joined'"))).length === 2);
  await withUser(alice, (q) => q("delete from trip_members where trip_id=$1 and user_id=$2", [tripId, bob]));
  check("removed member loses access", (await withUser(bob, (q) => q("select 1 from trips where id=$1", [tripId]))).length === 0);
  check("owner can delete the trip", (await withUser(alice, (q) => q("delete from trips where id=$1 returning id", [tripId]))).length === 1);

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll RLS checks passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
