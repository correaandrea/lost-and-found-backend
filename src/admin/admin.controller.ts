import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import type { AdminItemsQuery } from './admin.service';
import type { PaginationQuery } from '../common/pagination';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('items')
  listItems(@Query() query: AdminItemsQuery) {
    return this.adminService.listItems(query);
  }

  @Delete('items/:id')
  deleteItem(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.adminService.deleteItem(id, req.user.userId);
  }

  @Patch('items/:id/state')
  setItemState(@Param('id', ParseIntPipe) id: number, @Body() body: { state: string; note?: string }, @Req() req: any) {
    return this.adminService.setItemState(id, body?.state, req.user.userId, body?.note);
  }

  @Get('audit')
  listAudit(@Query() query: PaginationQuery) {
    return this.adminService.listAudit(query);
  }
}
