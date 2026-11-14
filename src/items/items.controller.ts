import { Controller, Get, Post, Patch, Body, UploadedFile, UseInterceptors, Param, ParseIntPipe, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService } from './items.service';
import type { RawItemQuery } from './item-filters';
import { AuthGuard } from '@nestjs/passport';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('image'))
  async createItem(@Body() body: any, @UploadedFile() file: any, @Req() req: any) {
    return this.itemsService.create(body, file, req.user.userId);
  }

  /**
   * Listado paginado. Parámetros opcionales: search, location, category, city y status
   * (los tres últimos admiten varios valores separados por barra vertical (|)), from y to (AAAA-MM-DD),
   * page y limit.
   */
  @Get()
  async findAll(@Query() query: RawItemQuery) {
    return await this.itemsService.findAll(query);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async findMyItems(@Req() req: any) {
    return this.itemsService.findMyItems(req.user.userId);
  }

  /** Correo de quien publicó el reporte, para contactarlo (solo usuarios autenticados). */
  @Get(':id/contact')
  @UseGuards(AuthGuard('jwt'))
  async getContact(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.itemsService.getContact(id, req.user.userId);
  }

  /** Quien publicó el reporte lo marca como resuelto (RESOLVED) o lo reabre (ACTIVE). */
  @Patch(':id/state')
  @UseGuards(AuthGuard('jwt'))
  async setState(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { state: string; note?: string },
    @Req() req: any,
  ) {
    return this.itemsService.setState(id, body?.state, req.user.userId, body?.note);
  }

  @Get(':id/matches')
  async findMatches(@Param('id') id: string) {
    return this.itemsService.findMatches(Number(id));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.itemsService.findOne(Number(id));
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.itemsService.remove(Number(id), req.user.userId);
  }
}