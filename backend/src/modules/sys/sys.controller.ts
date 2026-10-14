import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SysService } from './sys.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('系统管理')
@Controller('sys')
export class SysController {
  constructor(private sys: SysService) {}

  // ============ 字典 ============
  @Get('dict')
  dict(@Query('type') type?: string) {
    return this.sys.listDict(type);
  }

  @Get('dict-map')
  dictMap(@Query('types') types?: string) {
    const arr = types ? types.split(',').map((t) => t.trim()) : [];
    return this.sys.listDictByTypes(arr);
  }

  // ============ 部门 ============
  @Get('depts')
  depts() {
    return this.sys.listDepts();
  }

  @Get('depts-tree')
  deptsTree() {
    return this.sys.getDeptTree();
  }

  @Post('depts')
  @Permissions('dept:manage')
  createDept(@Body() dto: any) {
    return this.sys.createDept(dto);
  }

  @Put('depts/:id')
  @Permissions('dept:manage')
  updateDept(@Param('id') id: string, @Body() dto: any) {
    return this.sys.updateDept(Number(id), dto);
  }

  @Delete('depts/:id')
  @Permissions('dept:manage')
  deleteDept(@Param('id') id: string) {
    return this.sys.deleteDept(Number(id));
  }

  // ============ 菜单 ============
  // 当前登录用户可见菜单（最终授权）
  @Get('menus')
  async menus(@CurrentUser() user: any) {
    const result = await this.sys.listMenusForUser(user);
    return result.tree || [];
  }

  // 全部菜单（扁平，供分配界面构造树）
  @Get('menus-all')
  @Permissions('menu:view')
  menusAll() {
    return this.sys.listAllMenus();
  }

  @Post('menus')
  @Permissions('menu:create')
  createMenu(@Body() dto: any) {
    return this.sys.createMenu(dto);
  }

  @Put('menus/:id')
  @Permissions('menu:update')
  updateMenu(@Param('id') id: string, @Body() dto: any) {
    return this.sys.updateMenu(Number(id), dto);
  }

  @Delete('menus/:id')
  @Permissions('menu:delete')
  deleteMenu(@Param('id') id: string) {
    return this.sys.deleteMenu(Number(id));
  }

  // ============ 操作权限目录 ============
  @Get('operations')
  @Permissions('operation:view')
  operations() {
    return this.sys.listOperations();
  }

  @Post('operations')
  @Permissions('operation:create')
  createOperation(@Body() dto: any) {
    return this.sys.createOperation(dto);
  }

  @Put('operations/:id')
  @Permissions('operation:update')
  updateOperation(@Param('id') id: string, @Body() dto: any) {
    return this.sys.updateOperation(Number(id), dto);
  }

  @Delete('operations/:id')
  @Permissions('operation:delete')
  deleteOperation(@Param('id') id: string) {
    return this.sys.deleteOperation(Number(id));
  }

  // ============ 角色 ============
  @Get('roles')
  @Permissions('role:view')
  roles() {
    return this.sys.listRoles();
  }

  @Post('roles')
  @Permissions('role:create')
  createRole(@Body() dto: any) {
    return this.sys.createRole(dto);
  }

  @Put('roles/:id')
  @Permissions('role:update')
  updateRole(@Param('id') id: string, @Body() dto: any) {
    return this.sys.updateRole(Number(id), dto);
  }

  @Delete('roles/:id')
  @Permissions('role:delete')
  deleteRole(@Param('id') id: string) {
    return this.sys.deleteRole(Number(id));
  }

  @Get('roles/:id/menus')
  @Permissions('role:assign')
  roleMenus(@Param('id') id: string) {
    return this.sys.getRoleMenuIds(Number(id));
  }

  @Put('roles/:id/menus')
  @Permissions('role:assign')
  setRoleMenus(@Param('id') id: string, @Body() body: { menuIds: number[] }) {
    return this.sys.setRoleMenus(Number(id), body.menuIds);
  }

  @Get('roles/:id/operations')
  @Permissions('role:assign')
  roleOperations(@Param('id') id: string) {
    return this.sys.getRoleOperationCodes(Number(id));
  }

  @Put('roles/:id/operations')
  @Permissions('role:assign')
  setRoleOperations(@Param('id') id: string, @Body() body: { codes: string[] }) {
    return this.sys.setRoleOperations(Number(id), body.codes);
  }

  // ============ 用户 ============
  @Get('users')
  users(@Query('keyword') keyword?: string) {
    return this.sys.listUsers(keyword);
  }

  @Get('users/list')
  @Permissions('user:view')
  usersList(@Query() q: any) {
    return this.sys.listUsersPage(q);
  }

  @Post('users')
  @Permissions('user:create')
  createUser(@Body() dto: any) {
    return this.sys.createUser(dto);
  }

  @Put('users/:id')
  @Permissions('user:update')
  updateUser(@Param('id') id: string, @Body() dto: any) {
    return this.sys.updateUser(Number(id), dto);
  }

  @Delete('users/:id')
  @Permissions('user:delete')
  deleteUser(@Param('id') id: string) {
    return this.sys.deleteUser(Number(id));
  }

  // 管理员改任意用户密码（含自己）：body 必须含原密码；isAdmin 兜底；改自己由前端决定要不要 logout
  @Post('users/:id/change-password')
  @Permissions('user:update')
  async changeUserPassword(
    @Param('id') id: string,
    @Body() body: { oldPassword: string; newPassword: string },
    @CurrentUser() user: any,
  ) {
    if (!user?.isAdmin) throw new ForbiddenException('仅管理员可修改密码');
    return this.sys.changeUserPassword(user.id, Number(id), body.oldPassword, body.newPassword);
  }

  // 应用角色模板（把角色菜单/操作复制为该用户直接授权）
  @Post('users/:id/apply-role/:roleId')
  @Permissions('user:assign')
  applyRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    return this.sys.applyRoleTemplate(Number(id), Number(roleId));
  }

  @Get('users/:id/menus')
  @Permissions('user:assign')
  userMenus(@Param('id') id: string) {
    return this.sys.getUserMenuIds(Number(id));
  }

  @Put('users/:id/menus')
  @Permissions('user:assign')
  setUserMenus(@Param('id') id: string, @Body() body: { menuIds: number[] }) {
    return this.sys.setUserMenus(Number(id), body.menuIds);
  }

  @Get('users/:id/operations')
  @Permissions('user:assign')
  userOperations(@Param('id') id: string) {
    return this.sys.getUserOperationCodes(Number(id));
  }

  @Put('users/:id/operations')
  @Permissions('user:assign')
  setUserOperations(@Param('id') id: string, @Body() body: { codes: string[] }) {
    return this.sys.setUserOperations(Number(id), body.codes);
  }

  // 下载用户导入模板
  @Get('users/template')
  @Permissions('user:import')
  template(@Res({ passthrough: true }) res: Response) {
    const buf = this.sys.buildUserTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.xlsx"');
    return buf;
  }

  // 导入用户
  @Post('users/import')
  @Permissions('user:import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importUsers(@UploadedFile() file: any) {
    if (!file || !file.buffer) throw new Error('未接收到文件');
    return this.sys.importUsers(file.buffer);
  }

  // ============ 旧接口兼容 ============
  @Get('regions')
  regions(@Query('parentId') parentId?: string) {
    return this.sys.listRegions(parentId ? Number(parentId) : undefined);
  }

  @Get('regions-tree')
  regionsTree() {
    return this.sys.listRegionTree();
  }

  // ============ 公司信息（单例） ============
  // @Public：登录页（无 token）也要展示公司名/Logo；侧栏/PDF 复用同一接口
  @Public()
  @Get('company')
  company() {
    return this.sys.getCompany();
  }

  @Put('company')
  @Permissions('company:update')
  saveCompany(@Body() body: any) {
    return this.sys.saveCompany(body);
  }
}
