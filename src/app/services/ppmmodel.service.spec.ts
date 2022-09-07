import { TestBed } from '@angular/core/testing';

import { PpmmodelService } from './ppmmodel.service';

describe('PpmmodelService', () => {
  let service: PpmmodelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PpmmodelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
