import { Link, useParams } from 'react-router-dom';
import { useStore } from '../demo/store';
import { findCampaign, findSlot, people, setViewer, type Slot } from '../demo/world';
import { paths } from '../routes';
import { Note, PageHead, useTitle } from '../ui/parts';

export function useRecord() {
  const { campaignId, depositId } = useParams();
  const store = useStore();
  const record = findCampaign(store.world, campaignId);
  const slot = record && depositId ? findSlot(record, depositId) : undefined;
  return { ...store, record, slot };
}

// Screens set their own document title; this only fills the page.
export function Missing({ what }: { what: 'campaign' | 'deposit' | 'page' }) {
  return (
    <PageHead title={what === 'page' ? 'Page not found' : `No ${what} at this address`}>
      <p>
        {what === 'page'
          ? 'That address doesn’t match a page here.'
          : `The link may be mistyped, or the ${what} was made in another browser session.`}
      </p>
      <p className="link-alone"><Link to={paths.home()}>See all campaigns</Link></p>
    </PageHead>
  );
}

export function NotFound() {
  useTitle('Page not found');
  return <Missing what="page" />;
}

// Each backer's key lives in their own browser. In the prototype one browser plays all
// four people, so a page about someone else's deposit offers a way to step into their seat.
export function NotYours({ slot }: { slot: Slot }) {
  const { apply } = useStore();
  const owner = people[slot.backerId!];
  return (
    <Note title={`This is ${owner.short}’s deposit.`}>
      <p>Only {owner.short} can sign it or take it back. The key is in {owner.short}’s browser, not this one.</p>
      <p>
        <button type="button" className="button" data-size="small" onClick={() => apply(world => setViewer(world, owner.id))}>
          View as {owner.short}
        </button>
      </p>
    </Note>
  );
}
