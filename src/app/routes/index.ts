import express, { Router } from "express";

const router = express.Router();

const moduleRoutes: { path: string; route: Router }[] = [
  /* {
          path: '/',
          route: router
      }, */
  // {
  //   path: "/user",
  //   route: userRoutes,
  // },
  // {
  //   path: "/oldAuth",
  //   route: authRoutes,
  // },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
