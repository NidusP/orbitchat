import { Hono } from 'hono';
import { clientMetaMiddleware } from '../../middleware/client-meta';
import { aiRouter } from './ai';
import { authRouter } from './auth';
import { conversationsRouter } from './conversations';
import { feedRouter } from './feed';
import { postsRouter } from './posts';
import { usersRouter } from './users';

export const v1Router = new Hono();

v1Router.use('*', clientMetaMiddleware);

v1Router.route('/ai', aiRouter);
v1Router.route('/auth', authRouter);
v1Router.route('/conversations', conversationsRouter);
v1Router.route('/feed', feedRouter);
v1Router.route('/posts', postsRouter);
v1Router.route('/users', usersRouter);
