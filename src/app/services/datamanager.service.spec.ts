import { TestBed } from '@angular/core/testing';

import { DatamanagerService } from './datamanager.service';

describe('DatamanagerService', () => {
  let service: DatamanagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DatamanagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
