import { TestBed } from '@angular/core/testing';

import { SilhouetteService } from './silhouette.service';

describe('SilhouetteService', () => {
  let service: SilhouetteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SilhouetteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
