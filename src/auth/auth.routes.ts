import { Router } from "express";
import { register, login, changePassword, setPasswordWithToken } from "./auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
/** Public: set password via one-time token from staff invite email link */
router.post("/set-password-with-token", setPasswordWithToken);
router.put("/change-password", authMiddleware, changePassword);

export default router;
