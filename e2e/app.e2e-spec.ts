import { nercoreangularTemplatePage } from './app.po';

describe('nercoreangular App', function() {
  let page: nercoreangularTemplatePage;

  beforeEach(() => {
    page = new nercoreangularTemplatePage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
