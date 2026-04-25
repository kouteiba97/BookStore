import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AdminAcademicService } from './admin-academic.service';

class NameDto {
  name: string;
}

class FieldDto extends NameDto {}

class YearDto extends NameDto {
  fieldId: string;
}

class SubjectDto extends NameDto {
  yearId: string;
}

@Controller('v1/admin/academic')
export class AdminAcademicController {
  constructor(private readonly service: AdminAcademicService) {}

  @Get('tree')
  tree() {
    return this.service.tree();
  }

  // Fields
  @Post('fields')
  createField(@Body() dto: FieldDto) {
    return this.service.createField(dto.name);
  }

  @Patch('fields/:id')
  updateField(@Param('id') id: string, @Body() dto: FieldDto) {
    return this.service.updateField(id, dto.name);
  }

  @Delete('fields/:id')
  deleteField(@Param('id') id: string) {
    return this.service.deleteField(id);
  }

  // Years
  @Post('years')
  createYear(@Body() dto: YearDto) {
    return this.service.createYear(dto.fieldId, dto.name);
  }

  @Patch('years/:id')
  updateYear(@Param('id') id: string, @Body() dto: NameDto) {
    return this.service.updateYear(id, dto.name);
  }

  @Delete('years/:id')
  deleteYear(@Param('id') id: string) {
    return this.service.deleteYear(id);
  }

  // Subjects
  @Post('subjects')
  createSubject(@Body() dto: SubjectDto) {
    return this.service.createSubject(dto.yearId, dto.name);
  }

  @Patch('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() dto: NameDto) {
    return this.service.updateSubject(id, dto.name);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string) {
    return this.service.deleteSubject(id);
  }
}
