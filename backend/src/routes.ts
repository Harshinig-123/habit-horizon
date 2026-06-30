import { Router } from 'express';
import * as ctrl from './habithorizon/habithorizon.controller';

const router = Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/ping', (_req, res) => res.json({ pong: true }));

// ── Profile ───────────────────────────────────────────────────────────────────
router.post('/auth/signup',         ctrl.signup);
router.post('/auth/login',          ctrl.login);
router.get('/profile/:userId',      ctrl.getProfile);
router.post('/profile',             ctrl.saveProfile);
router.post('/profile/:userId/reset', ctrl.resetProfile);

// ── Habits ────────────────────────────────────────────────────────────────────
router.get('/habits/:userId',      ctrl.getHabits);
router.post('/habits/toggle',      ctrl.toggleHabit);
router.post('/habits/add',         ctrl.addHabit);
router.post('/habits/delete',      ctrl.deleteHabit);

// ── Planning ──────────────────────────────────────────────────────────────────
router.get('/planning/:userId',    ctrl.getPlanning);
router.post('/planning/save',      ctrl.savePlanning);
router.post('/planning/task/add',  ctrl.addTask);
router.post('/planning/task/toggle', ctrl.toggleTask);
router.post('/planning/task/delete', ctrl.deleteTask);

// ── AI — Chat (proxies to Claude with server-side PII stripping) ──────────────
router.post('/chat',               ctrl.chat);

// ── AI — Plan generation ──────────────────────────────────────────────────────
router.post('/plan/generate',      ctrl.generatePlan);

export default router;
