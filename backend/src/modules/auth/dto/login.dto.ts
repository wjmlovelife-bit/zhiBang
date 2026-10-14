import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * 登录入参 DTO
 *
 * 【为何必须用 DTO + class-validator】
 * 之前 `@Body() body: { username: string; password: string }` 只是 TS 类型注解，运行时拿到的还是普通对象。
 * 当 body={} 时 body.username === undefined → AuthService.login(undefined, undefined) → prisma.findUnique({ where: { username: undefined }}) 抛错 → 500。
 * 当 body={username: { $ne: null }} 时 PrismaClientValidationError → 500。
 *
 * 改用本 DTO 后，全局 ValidationPipe 会用 class-validator 自动校验，
 * 任何字段类型/长度不匹配统一返回 400，不再抛 5xx。
 */
export class LoginDto {
  @IsString({ message: 'username 必须是字符串' })
  @IsNotEmpty({ message: 'username 不能为空' })
  @MaxLength(64, { message: 'username 长度不能超过 64' })
  username: string;

  @IsString({ message: 'password 必须是字符串' })
  @IsNotEmpty({ message: 'password 不能为空' })
  @MaxLength(128, { message: 'password 长度不能超过 128' })
  password: string;
}
