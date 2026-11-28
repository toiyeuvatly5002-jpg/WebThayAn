const crypto = require("node:crypto");

function invalid(message, status = 400) {
  throw Object.assign(new Error(message), {status});
}

function readMinutes(value) {
  if (value == null || value === "" || value === 0) return 0;
  if (!Number.isSafeInteger(value) || value < 1 || !Number.isFinite(new Date(Date.now()+value*60000).getTime())) {
    invalid("Hãy nhập thời gian làm bài bằng số phút nguyên dương hợp lệ.");
  }
  return value;
}

function isWorking(row, now = Date.now()) {
  return Boolean(row?.timed && !row.finishedEarly && now < row.date);
}

function newSlot(minutes, now = Date.now()) {
  return {attemptId: crypto.randomUUID(), deadline: now + minutes * 60000};
}

// An untimed attempt already opened by a student remains submittable if the
// teacher enables a timer later. Only the server holds the session signing key.
function signature(session, id, nonce) {
  return crypto.createHmac("sha256",session.examKey).update(session.code+"/"+id+"/"+nonce).digest("hex").slice(0,32);
}
function freeTicket(session, id) {
  const nonce=crypto.randomUUID();
  return nonce+"-"+signature(session,id,nonce);
}
function validFreeTicket(session, id, ticket) {
  if(!session.examKey || typeof ticket!=="string" || !/^[a-f0-9-]{36}-[a-f0-9]{32}$/.test(ticket))return false;
  return crypto.timingSafeEqual(Buffer.from(ticket.slice(37)),Buffer.from(signature(session,id,ticket.slice(0,36))));
}

function indexOfField(key, length) {
  const i = Number(key);
  if (!Number.isInteger(i) || String(i) !== key || i < 0 || i >= length) invalid("Số câu không hợp lệ.");
  return i;
}

// A stored timed row is already graded and dated at the deadline. Readers
// expose it at that instant, even if every browser has gone offline.
function updateRow(row, slot, item, code, user, action, body, score, now = Date.now()) {
  if (row && !isWorking(row, now)) return row;
  if (action === "open" && row) return row;
  if (!row && action !== "open") invalid("Hãy mở lại đề để tiếp tục lượt làm.", 409);
  const count = item.answerSheet.length;
  const answers = row ? [...row.answers] : Array(count).fill("");
  const photos = {...row?.photos};
  if (action !== "open") {
    for (const [key, answer] of Object.entries(body.changes || {})) {
      const i = indexOfField(key, count);
      if (typeof answer !== "string" || answer.length > 80) invalid("Đáp án chưa hợp lệ.");
      answers[i] = answer;
    }
    for (const [key, pages] of Object.entries(body.photos || {})) {
      const i = indexOfField(key, count);
      if (item.fields[i] !== "essay" || !Array.isArray(pages) || !pages.length) invalid("Ảnh bài làm chưa hợp lệ.");
      photos[i] = pages;
    }
    if (JSON.stringify(photos).length > 4200000) invalid("Tổng dung lượng ảnh vượt giới hạn của một bài nộp.");
  }
  const early = action === "finishTimed";
  const record = score(item, {answers,photos}, code, user, early ? now : slot.deadline, !early);
  return {...record, timed:true, finishedEarly:early, deadline:slot.deadline};
}

function timedReply(row, key, slot, receipt, now = Date.now()) {
  if (!isWorking(row, now)) return {receipt:receipt(row, key), attemptId:slot.attemptId};
  return {attemptId:slot.attemptId, deadline:slot.deadline, serverNow:now};
}

function openReply(row, key, slot, receipt, itemView) {
  const reply = timedReply(row, key, slot, receipt);
  if (reply.receipt) return reply;
  const photoCounts = Object.fromEntries(Object.entries(row.photos || {}).filter(([,pages])=>pages?.length).map(([i,pages])=>[i,pages.length]));
  return {...itemView, clock:{...reply, answers:row.answers, photoCounts}};
}

module.exports = {readMinutes, isWorking, newSlot, updateRow, openReply, timedReply, freeTicket, validFreeTicket};
