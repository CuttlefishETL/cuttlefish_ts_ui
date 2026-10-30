import type {
  ActiveSession,
  RoleCreateInput,
  RoleInput,
  RoleRecord,
  UserCreateInput,
  UserRecord,
  UserUpdateInput,
} from "./types";

export interface SecurityApi {
  listSessions(signal?: AbortSignal): Promise<ActiveSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  deleteUserSessions(userId: number): Promise<void>;

  listUsers(signal?: AbortSignal): Promise<UserRecord[]>;
  createUser(input: UserCreateInput): Promise<UserRecord>;
  updateUser(id: number, input: UserUpdateInput): Promise<UserRecord>;
  changePassword(id: number, password: string): Promise<void>;
  deleteUser(id: number): Promise<void>;

  listRoles(signal?: AbortSignal): Promise<RoleRecord[]>;
  createRole(input: RoleCreateInput): Promise<RoleRecord>;
  updateRole(name: string, input: RoleInput): Promise<RoleRecord>;
  deleteRole(name: string): Promise<void>;
}