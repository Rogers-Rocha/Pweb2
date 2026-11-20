import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CheckinsService } from './checkins.service';
import { CheckinQueryDto } from './dto/checkin-query.dto';
import { CreateCheckinDto } from './dto/create-checkin.dto';

@ApiTags('checkins')
@ApiBearerAuth()
@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post()
  create(@Body() dto: CreateCheckinDto, @CurrentUser() user: AuthUser) {
    return this.checkins.create(dto, user);
  }

  @Get()
  findAll(@Query() q: CheckinQueryDto, @CurrentUser() user: AuthUser) {
    return this.checkins.findAll(user, q);
  }
}
