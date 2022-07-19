import { TestBed } from '@angular/core/testing';

import { DbmeansService } from './dbmeans.service';

describe('DbmeansService', () => {
  let service: DbmeansService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DbmeansService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
