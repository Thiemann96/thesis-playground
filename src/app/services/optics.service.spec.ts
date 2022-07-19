import { TestBed } from '@angular/core/testing';

import { OpticsService } from './optics.service';

describe('OpticsService', () => {
  let service: OpticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
