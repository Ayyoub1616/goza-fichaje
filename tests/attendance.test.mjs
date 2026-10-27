import test from "node:test";import assert from "node:assert/strict";
import {attendanceStatus,localMadridToISO,localDay,minutes,plusDays} from "../attendance.mjs";
test("convertir hora Madrid en UTC verano e invierno",()=>{
 assert.equal(localMadridToISO("2026-07-01T13:00"),"2026-07-01T11:00:00.000Z");
 assert.equal(localMadridToISO("2026-12-01T13:00"),"2026-12-01T12:00:00.000Z");
});
test("detectar hora inexistente/ambigua DST",()=>{
 assert.throws(()=>localMadridToISO("2027-03-28T02:30"),/no existe/i);
 assert.throws(()=>localMadridToISO("2027-10-31T02:30"),/ambigua/i);
});
test("planificación cruza medianoche",()=>{
 const start=localMadridToISO("2026-10-28T21:00"),end=localMadridToISO("2026-10-29T01:00");
 assert.ok(new Date(end)>new Date(start));
 assert.equal(localDay(start),"2026-10-28");
});
test("puntualidad con 5 minutos de cortesía",()=>{
 const p={status:"scheduled",starts_at:"2026-10-27T17:00:00Z",ends_at:"2026-10-27T22:00:00Z"};
 assert.equal(attendanceStatus(p,{started_at:"2026-10-27T17:04:00Z",ended_at:null}).key,"working");
 assert.equal(attendanceStatus(p,{started_at:"2026-10-27T17:08:00Z",ended_at:null}).key,"late");
 assert.equal(attendanceStatus(p,{started_at:"2026-10-27T17:00:00Z",ended_at:"2026-10-27T21:40:00Z"}).key,"early");
 assert.equal(attendanceStatus(p,{started_at:"2026-10-27T17:00:00Z",ended_at:"2026-10-27T22:20:00Z"}).key,"extra");
});
test("no asigna falta antes del fin del turno; da aviso tras tolerancia",()=>{
 const p={status:"scheduled",starts_at:"2026-10-27T17:00:00Z",ends_at:"2026-10-27T22:00:00Z"};
 assert.equal(attendanceStatus(p,null,Date.parse("2026-10-27T16:50:00Z")).key,"planned");
 assert.equal(attendanceStatus(p,null,Date.parse("2026-10-27T17:06:00Z")).key,"missing");
 assert.equal(attendanceStatus(p,null,Date.parse("2026-10-27T22:01:00Z")).key,"absent");
});
test("helpers de semana",()=>{
 assert.equal(plusDays("2026-12-31",1),"2027-01-01");
 assert.equal(minutes("2026-10-27T15:10:00Z","2026-10-27T15:00:00Z"),10);
});
