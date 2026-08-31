import { Controller, Get, Param } from '@nestjs/common';
import { AcademicService } from './academic.service';

@Controller('v1/:storeSlug')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('fields')
  getFields(@Param('storeSlug') storeSlug: string) {
    return this.academicService.getFields(storeSlug);
  }

  @Get('fields/:fieldId/years')
  getYears(
    @Param('storeSlug') storeSlug: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.academicService.getYears(storeSlug, fieldId);
  }

  @Get('fields/:fieldId/books')
  getBooksByField(
    @Param('storeSlug') storeSlug: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.academicService.getBooksByField(storeSlug, fieldId);
  }

  @Get('years/:yearId/subjects')
  getSubjects(
    @Param('storeSlug') storeSlug: string,
    @Param('yearId') yearId: string,
  ) {
    return this.academicService.getSubjects(storeSlug, yearId);
  }

  @Get('years/:yearId/books')
  getBooksByYear(
    @Param('storeSlug') storeSlug: string,
    @Param('yearId') yearId: string,
  ) {
    return this.academicService.getBooksByYear(storeSlug, yearId);
  }

  @Get('subjects/:subjectId/books')
  getBooksBySubject(
    @Param('storeSlug') storeSlug: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.academicService.getBooksBySubject(storeSlug, subjectId);
  }
}
