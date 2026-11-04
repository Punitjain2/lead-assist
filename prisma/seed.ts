import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DAY = 24 * 3600 * 1000;

// ASSUMPTION (labelled in TDD): project names, RERA numbers, addresses and
// spend split are invented sample data in the Gujarat RERA format. Nothing
// here is real personal data.
async function main() {
  await prisma.outbox.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.handoff.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.factSheet.deleteMany();
  await prisma.sourceSpend.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash("demo1234", 10);
  const head = await prisma.user.create({
    data: { email: "head@demo.in", name: "Meera Desai", passwordHash: hash, role: "SALES_HEAD" }
  });
  const execNames = ["Priya Trivedi", "Rohan Mehta", "Jignesh Parmar", "Ankita Raval", "Sandeep Chauhan",
    "Hetal Vyas", "Parth Gandhi", "Krupa Soni", "Vivek Panchal", "Dhruvi Bhatt"];
  const execs = [];
  for (let i = 0; i < execNames.length; i++) {
    execs.push(await prisma.user.create({
      data: { email: `exec${i + 1}@demo.in`, name: execNames[i], passwordHash: hash, role: "SALES_EXEC" }
    }));
  }

  await prisma.factSheet.create({
    data: {
      project: "PROJECT_1",
      title: "Vrindavan Greens",
      rera: "PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA14021/081224",
      address: "Nr. Shilaj Circle, S.P. Ring Road, Ahmedabad 380059",
      mapsUrl: "https://maps.google.com/?q=23.0760,72.4990",
      content: `Configuration: 3 BHK only, 240 apartments across 4 towers of 14 floors.
Carpet area: 3 BHK 1,180 to 1,340 sq ft.
Price: starting from Rs 92 lakh (3 BHK), as per registered details. Final price depends on floor and tower; a sales executive confirms it in person.
Possession: December 2027. Construction at 9th slab as of October 2026.
Amenities: clubhouse with gym and pool, landscaped podium garden, children's play area, 2 covered parking slots per flat, 24x7 security with video door phones.
Payment plan: construction-linked plan available; details confirmed by the sales team.
Banks: SBI, HDFC and ICICI home loans approved for this project.
Site visit hours: Tuesday to Sunday, 10 am to 6 pm. Closed Monday.
Nearby: Shilaj railway crossing 5 min, SGVP school 10 min, Iscon-Ambli road 12 min.`
    }
  });
  await prisma.factSheet.create({
    data: {
      project: "PROJECT_2",
      title: "Anandam Skyview",
      rera: "PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA15387/030425",
      address: "Opp. Vaishnodevi Circle, S.G. Highway, Ahmedabad 382421",
      mapsUrl: "https://maps.google.com/?q=23.1310,72.5410",
      content: `Configuration: 2 and 3 BHK, 180 apartments across 2 towers of 18 floors.
Carpet area: 2 BHK 720 to 810 sq ft, 3 BHK 1,050 to 1,160 sq ft.
Price: starting from Rs 65 lakh (2 BHK) and Rs 88 lakh (3 BHK), as per registered details. Final price depends on floor and view; a sales executive confirms it in person.
Possession: June 2027. Construction at 15th slab as of October 2026.
Amenities: rooftop lounge, gym, indoor games room, EV charging in basement parking, rainwater harvesting, 24x7 security.
Payment plan: 10:20:70 scheme registered; details confirmed by the sales team.
Banks: HDFC, Axis and Bank of Baroda home loans approved for this project.
Site visit hours: all days, 10 am to 7 pm.
Nearby: Vaishnodevi metro 3 min, Nirma University 8 min, Science City 15 min.`
    }
  });

  await prisma.sourceSpend.createMany({
    data: [
      { source: "PORTAL", monthlySpend: 1200000 },
      { source: "SOCIAL", monthlySpend: 900000 },
      { source: "WEBSITE", monthlySpend: 500000 },
      { source: "HOARDING", monthlySpend: 400000 }
    ]
  });

  // Slots: next 14 days, four times a day per project, capacity 3.
  const times = [{ h: 10, m: 0 }, { h: 11, m: 30 }, { h: 15, m: 0 }, { h: 16, m: 30 }];
  const slotIds: Record<string, string[]> = { PROJECT_1: [], PROJECT_2: [] };
  const today = new Date();
  for (let d = -7; d <= 14; d++) {
    for (const project of ["PROJECT_1", "PROJECT_2"]) {
      if (project === "PROJECT_1" && new Date(today.getTime() + d * DAY).getDay() === 1) continue; // closed Monday
      for (const t of times) {
        // Pin slot times to IST regardless of the host machine's timezone.
        const day = new Date(today.getTime() + d * DAY);
        const startsAt = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), t.h - 5, t.m - 30));
        const s = await prisma.slot.create({ data: { project, startsAt, capacity: 3 } });
        if (d > 0) slotIds[project].push(s.id);
      }
    }
  }

  const first = ["Hardik", "Nidhi", "Kavita", "Amit", "Sneha", "Rakesh", "Pooja", "Manish", "Falguni", "Chirag",
    "Bhavin", "Riya", "Tejas", "Komal", "Nilesh", "Aarti", "Sanjay", "Mittal", "Yash", "Divya",
    "Harsh", "Payal", "Kunal", "Shruti", "Alpesh", "Mansi", "Ketan", "Rinku", "Jay", "Vaishali"];
  const last = ["Patel", "Shah", "Joshi", "Desai", "Mehta", "Trivedi", "Prajapati", "Thakkar", "Solanki", "Rana",
    "Vaghela", "Dave", "Bhatt", "Modi", "Jani"];
  const sources = ["PORTAL", "PORTAL", "PORTAL", "PORTAL", "SOCIAL", "SOCIAL", "SOCIAL", "WEBSITE", "WEBSITE", "HOARDING"];
  const wantsArr = ["2 BHK", "3 BHK"];

  let code = 58210;
  const given = [
    { name: "Hardik Patel", source: "PORTAL", project: "PROJECT_1", wants: "3 BHK", visit: "BOOKED" },
    { name: "Nidhi Shah", source: "SOCIAL", project: "PROJECT_2", wants: "2 BHK", visit: "NONE" },
    { name: "Kavita Joshi", source: "HOARDING", project: "PROJECT_2", wants: "2 BHK", visit: "VISITED" }
  ];

  const mkPhone = (i: number) => "+9198" + String(25011200 + i * 7).padStart(8, "0");

  const allLeads: { id: string; project: string; visit: string }[] = [];
  for (let i = 0; i < 60; i++) {
    const g = i < 3 ? given[i] : null;
    const name = g ? g.name : `${first[i % first.length]} ${last[(i * 3) % last.length]}`;
    const source = g ? g.source : sources[i % sources.length];
    const project = g ? g.project : i % 3 === 0 ? "PROJECT_1" : "PROJECT_2";
    const wants = g ? g.wants : wantsArr[i % 2];
    const createdAt = new Date(Date.now() - (2 + (i * 11) % 28) * DAY - (i % 24) * 3600 * 1000);
    // Mirror the client's problem: ~35% of historic leads never got a response.
    const responded = i % 20 < 13;
    const firstResponseAt = responded
      ? new Date(createdAt.getTime() + (i % 5 === 0 ? 3 : 300 + (i % 10) * 90) * 60000)
      : null;
    const visit = g ? g.visit : i % 7 === 0 ? "VISITED" : i % 7 === 1 ? "BOOKED" : i % 7 === 2 ? "NO_SHOW" : "NONE";
    const lead = await prisma.lead.create({
      data: {
        leadCode: "LD-" + code++,
        name,
        phone: mkPhone(i),
        source, project, wants,
        budgetBand: wants === "2 BHK" ? "65-80L" : "88L-1.2Cr",
        consent: true,
        optedOut: i === 41,
        status: visit === "NONE" ? (responded ? "ENGAGED" : "NEW") : visit === "BOOKED" ? "BOOKED" : visit,
        createdAt, firstResponseAt,
        language: i % 9 === 0 ? "gu" : i % 5 === 0 ? "hi" : "en"
      }
    });
    allLeads.push({ id: lead.id, project, visit });
  }

  // Two duplicate pairs: same person enquiring twice from two portals.
  const dupBase = allLeads[4];
  const baseLead = await prisma.lead.findUnique({ where: { id: dupBase.id } });
  for (const [i, src] of [[0, "SOCIAL"], [1, "WEBSITE"]] as [number, string][]) {
    const orig = await prisma.lead.findUnique({ where: { id: allLeads[4 + i * 3].id } });
    if (!orig) continue;
    await prisma.lead.create({
      data: {
        leadCode: "LD-" + code++,
        name: orig.name, phone: orig.phone, source: src,
        project: orig.project, wants: orig.wants, consent: true,
        duplicateOfId: orig.id,
        duplicateNote: `Same number as ${orig.leadCode} (${orig.source})`,
        createdAt: new Date(orig.createdAt.getTime() + 2 * DAY),
        firstResponseAt: new Date(orig.createdAt.getTime() + 2 * DAY + 2 * 60000),
        status: "ENGAGED"
      }
    });
  }
  void baseLead;

  // Bookings for BOOKED / VISITED / NO_SHOW leads, against future or past slots.
  const pastSlots = await prisma.slot.findMany({ where: { startsAt: { lt: new Date() } } });
  let fi: Record<string, number> = { PROJECT_1: 0, PROJECT_2: 0 };
  let pi = 0;
  for (const l of allLeads) {
    if (l.visit === "BOOKED") {
      const sid = slotIds[l.project][fi[l.project]++ % slotIds[l.project].length];
      await prisma.booking.create({ data: { leadId: l.id, slotId: sid } });
      await prisma.slot.update({ where: { id: sid }, data: { bookedCount: { increment: 1 } } });
      const slot = await prisma.slot.findUnique({ where: { id: sid } });
      if (slot) {
        await prisma.outbox.createMany({
          data: [
            { leadId: l.id, type: "REMINDER_1D", sendAt: new Date(slot.startsAt.getTime() - DAY), body: "Reminder (tomorrow): site visit" },
            { leadId: l.id, type: "REMINDER_2H", sendAt: new Date(slot.startsAt.getTime() - 2 * 3600 * 1000), body: "Reminder (in 2 hours): site visit" }
          ]
        });
      }
    } else if (l.visit === "VISITED" || l.visit === "NO_SHOW") {
      const ps = pastSlots.filter((s) => s.project === l.project);
      const slot = ps[pi++ % ps.length];
      if (slot) {
        await prisma.booking.create({ data: { leadId: l.id, slotId: slot.id, status: l.visit } });
      }
    }
  }

  // One worked example conversation with a handoff, so the review screens are not empty.
  const exLead = await prisma.lead.findFirst({ where: { leadCode: "LD-58211" } });
  if (exLead) {
    const conv = await prisma.conversation.create({ data: { leadId: exLead.id, flagged: true, flagNote: "price_negotiation" } });
    const lines: [string, string][] = [
      ["BUYER", "Hi, 2 BHK ka price kya hai Anandam Skyview me?"],
      ["ASSISTANT", "Anandam Skyview me 2 BHK Rs 65 lakh se shuru hote hain, registered details ke anusaar (RERA PR/GJ/AHMEDABAD/AHMEDABAD CITY/AUDA/RAA15387/030425). Final price floor aur view par depend karta hai. Aap kaunsa budget soch rahe hain?"],
      ["BUYER", "Kitna discount milega agar cash me lu?"],
      ["ASSISTANT", "Discount aur final price ki baat hamari sales team hi kar sakti hai. Main aapko Priya Trivedi se connect kar rahi hoon, woh aaj aapse baat karengi. Kya aap ek site visit bhi book karna chahenge?"]
    ];
    for (const [role, content] of lines) {
      await prisma.message.create({ data: { conversationId: conv.id, role, content } });
    }
    await prisma.handoff.create({
      data: {
        leadId: exLead.id, toUserId: execs[0].id, reason: "price_negotiation",
        summary: "Nidhi Shah, 2 BHK at Anandam Skyview, budget around 65-80L, asked for a cash discount. Speaks Hindi. No visit booked yet."
      }
    });
    await prisma.lead.update({ where: { id: exLead.id }, data: { status: "HANDED_OFF", assignedToId: execs[0].id } });
  }

  console.log("Seeded:", {
    users: 1 + execs.length,
    leads: await prisma.lead.count(),
    slots: await prisma.slot.count(),
    bookings: await prisma.booking.count()
  });
  void head;
}

main().finally(() => prisma.$disconnect());
