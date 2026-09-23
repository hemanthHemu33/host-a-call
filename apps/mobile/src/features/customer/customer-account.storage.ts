import { secureStorage } from '@/platform/secure-storage';
import {
  customerAccountPersistedStateSchema,
  initialCustomerAccountState,
  type CustomerAccountPersistedState,
} from './customer-account.models';

const customerAccountStorageKey = 'connecto.customer.account.state.v1';

const mergeById = <Item extends { id: string }>(
  seeded: readonly Item[],
  stored: readonly Item[],
) => {
  const map = new Map<string, Item>();

  for (const item of seeded) {
    map.set(item.id, item);
  }

  for (const item of stored) {
    map.set(item.id, item);
  }

  return [...map.values()];
};

const normalizeState = (input: unknown): CustomerAccountPersistedState => {
  const parsed = customerAccountPersistedStateSchema.parse(input);

  return customerAccountPersistedStateSchema.parse({
    ...initialCustomerAccountState,
    ...parsed,
    localNotifications: mergeById(
      initialCustomerAccountState.localNotifications,
      parsed.localNotifications,
    ),
    supportTickets: mergeById(
      initialCustomerAccountState.supportTickets,
      parsed.supportTickets,
    ),
  });
};

export const loadCustomerAccountState =
  async (): Promise<CustomerAccountPersistedState> => {
    const raw = await secureStorage.getItemAsync(customerAccountStorageKey);

    if (raw === null) {
      return initialCustomerAccountState;
    }

    try {
      return normalizeState(JSON.parse(raw) as unknown);
    } catch {
      await secureStorage.deleteItemAsync(customerAccountStorageKey);
      return initialCustomerAccountState;
    }
  };

export const persistCustomerAccountState = async (
  state: CustomerAccountPersistedState,
) => {
  const parsed = customerAccountPersistedStateSchema.parse(state);
  await secureStorage.setItemAsync(
    customerAccountStorageKey,
    JSON.stringify(parsed),
  );

  return parsed;
};

export const clearCustomerAccountState = async () => {
  await secureStorage.deleteItemAsync(customerAccountStorageKey);
};
