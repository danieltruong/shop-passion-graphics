import { Link } from 'react-router'
import Window from '../components/Window'
import Accordion from '../components/Accordion'
import { jokes, placeholders, policies } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import './content.css'

const TITLE = 'Frequently asked questions'

const SECTIONS = [
  {
    id: 'orders',
    title: 'Orders & payment',
    items: [
      {
        q: 'How do I pay?',
        a: 'Checkout runs on Stripe. You can pay with major credit cards, Visa or Mastercard debit, and Apple Pay or Google Pay on supported devices. We never see or store your card details.',
      },
      {
        q: 'Can I change or cancel my order?',
        a: "Email us as soon as you can. If your order hasn't shipped yet, we'll change it or cancel it with a full refund.",
      },
      {
        q: 'Which currency are prices in?',
        a: 'All prices are in Canadian dollars (CAD). If your card is in another currency, your bank handles the conversion and may charge a small fee.',
      },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping',
    items: [
      {
        q: 'How long does shipping take?',
        a: (
          <>
            Orders are packed by hand and ship within {policies.dispatchTime}. Delivery times by
            region are on the <Link to="/shipping">shipping page</Link>.
          </>
        ),
      },
      {
        q: 'Do you ship internationally?',
        a: "Right now we ship within Canada and to the US. If you're somewhere else, email us and we'll see what we can do.",
      },
      {
        q: 'How do I track my order?',
        a: "You'll get a tracking link by email when your order ships.",
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & exchanges',
    items: [
      {
        q: 'Can I return something?',
        a: (
          <>
            Yes. Unused items in their original condition can be returned within{' '}
            {policies.returnWindowDays} days of delivery. Custom and personalized pieces are final
            sale. Details on the <Link to="/shipping">returns page</Link>.
          </>
        ),
      },
      {
        q: 'My order arrived damaged. What now?',
        a: `Sorry about that! Email a photo to ${placeholders.email} within ${policies.damageReportDays} days of delivery and we'll send a replacement or refund you. No need to send it back.`,
      },
    ],
  },
  {
    id: 'products',
    title: 'Products',
    items: [
      {
        q: 'Will sold-out items come back?',
        a: 'Some do. Tap "Email me when it\'s back" on the product and we will write when it returns.',
      },
      {
        q: 'Why does mine look a little different from the photo?',
        a: 'Everything is made by hand, so small differences in colour and shape are normal. No two are exactly alike.',
      },
      {
        q: 'Do you take custom orders?',
        a: `Sometimes! Email ${placeholders.email} with what you have in mind. Custom pieces are final sale.`,
      },
      { q: jokes.faqQuestion, a: jokes.faqAnswer },
    ],
  },
]

export default function FaqPage() {
  usePageTitle(TITLE)

  return (
    <div className="content-page faq-page">
      <div className="content-intro">
        <h1 className="content-title rainbow-text">{TITLE}</h1>
        <p className="content-lead">
          Can&apos;t find it here? Email <a href={placeholders.emailHref}>{placeholders.email}</a>.
        </p>
      </div>

      <Window title="Help topics" className="faq-window">
        <nav aria-label="FAQ topics" className="faq-topics sunken">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="faq-topic">
              {section.title}
            </a>
          ))}
        </nav>
        <div className="faq-sections">
          {SECTIONS.map((section, sectionIndex) => (
            <section
              key={section.id}
              id={section.id}
              className="faq-section"
              aria-labelledby={`faq-${section.id}`}
            >
              <h2 id={`faq-${section.id}`}>{section.title}</h2>
              {section.items.map((item, itemIndex) => (
                <Accordion key={item.q} title={item.q} defaultOpen={sectionIndex === 0 && itemIndex === 0}>
                  {item.a}
                </Accordion>
              ))}
            </section>
          ))}
        </div>
      </Window>
    </div>
  )
}
