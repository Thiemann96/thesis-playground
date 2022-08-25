import { TestBed } from '@angular/core/testing';

import { DbindexService } from './dbindex.service';

describe('DbindexService', () => {
  let service: DbindexService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DbindexService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
