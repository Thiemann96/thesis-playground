import { TestBed } from '@angular/core/testing';

import { GeolifeService } from './geolife.service';

describe('GeolifeService', () => {
  let service: GeolifeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeolifeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
