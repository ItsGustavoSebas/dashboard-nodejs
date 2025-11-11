import { PubSub } from 'graphql-subscriptions';

/**
 * PubSub para manejar subscriptions en GraphQL
 * Este objeto se usa para publicar eventos que los clientes pueden suscribirse
 */
export const pubsub = new PubSub();

/**
 * Eventos disponibles para subscriptions
 */
export const EVENTS = {
  PROJECT_KPIS_UPDATED: 'PROJECT_KPIS_UPDATED',
  ANY_PROJECT_KPIS_UPDATED: 'ANY_PROJECT_KPIS_UPDATED',
  ETL_STATUS_CHANGE: 'ETL_STATUS_CHANGE',
  DASHBOARD_UPDATED: 'DASHBOARD_UPDATED',
};

export default pubsub;
