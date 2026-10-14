import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
/** 标记接口所需操作权限码；用户需拥有其中至少一个（管理员豁免） */
export const Permissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);
