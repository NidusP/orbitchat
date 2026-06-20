import { Hono } from 'hono';
import { clientMetaMiddleware } from '../../middleware/client-meta';
import { authRouter } from './auth';
import { usersRouter } from './users';

export const v1Router = new Hono();

v1Router.use('*', clientMetaMiddleware);

v1Router.route('/auth', authRouter);
v1Router.route('/users', usersRouter);
