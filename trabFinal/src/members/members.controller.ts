import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateMemberDto } from './dto/create-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Roles(Role.ADMIN, Role.TRAINER)
  @Post()
  create(@Body() dto: CreateMemberDto) {
    return this.members.create(dto);
  }

  @Roles(Role.ADMIN, Role.TRAINER)
  @Get()
  findAll(@Query() q: MemberQueryDto) {
    return this.members.findAll(q);
  }

  // Declarada ANTES de ':id' para não ser capturada pelo parâmetro.
  @Roles(Role.MEMBER)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.members.findMine(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.members.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.TRAINER)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto) {
    return this.members.update(id, dto);
  }
}
