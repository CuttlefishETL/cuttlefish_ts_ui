import type { SecurityApi } from "./api";
import type {
  ActiveSession,
  RoleCreateInput,
  RoleInput,
  RoleRecord,
  UserCreateInput,
  UserRecord,
  UserUpdateInput,
} from "./types";
import {
  listUsers as apiListUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  setUserPassword,
  listRoles as apiListRoles,
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
} from "../../api/client";
import { apiClient } from "../../api/http";

export function createSecurityApi(baseUrl: string): SecurityApi {
  const options = { ...apiClient.defaults, baseURL: baseUrl };

  return {
    async listSessions(signal?: AbortSignal): Promise<ActiveSession[]> {
      // Если в client.ts нет функции для сессий, используем apiClient напрямую
      const res = await apiClient.get<ActiveSession[]>("/admin/sessions", {
        ...options,
        signal,
      });
      return res.data;
    },

    async deleteSession(sessionId: string): Promise<void> {
      await apiClient.delete(`/admin/sessions/${sessionId}`, options);
    },

    async deleteUserSessions(userId: number): Promise<void> {
      await apiClient.delete(`/admin/users/${userId}/sessions`, options);
    },

    async listUsers(signal?: AbortSignal): Promise<UserRecord[]> {
      const res = await apiListUsers({ ...options, signal });
      // Предполагаем, что ответ содержит массив users
      return res.data.users ?? res.data;
    },

    async createUser(input: UserCreateInput): Promise<UserRecord> {
      const res = await apiCreateUser(input, options);
      return res.data;
    },

    async updateUser(id: number, input: UserUpdateInput): Promise<UserRecord> {
      const res = await apiUpdateUser(id, input, options);
      return res.data;
    },

    async changePassword(id: number, password: string): Promise<void> {
      await setUserPassword(id, { password }, options);
    },

    async deleteUser(id: number): Promise<void> {
      await apiDeleteUser(id, options);
    },

    async listRoles(signal?: AbortSignal): Promise<RoleRecord[]> {
      const res = await apiListRoles({ ...options, signal });
      return res.data.roles ?? res.data;
    },

    async createRole(input: RoleCreateInput): Promise<RoleRecord> {
      const res = await apiCreateRole(input, options);
      return res.data;
    },

    async updateRole(name: string, input: RoleInput): Promise<RoleRecord> {
      const res = await apiUpdateRole(name, input, options);
      return res.data;
    },

    async deleteRole(name: string): Promise<void> {
      await apiDeleteRole(name, options);
    },
  };
}