import { render } from '@testing-library/react';

import MapCard from './MapCard';

describe('MapCard', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<MapCard />);
    expect(baseElement).toBeTruthy();
  });
});
