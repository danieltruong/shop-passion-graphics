import Window from '../components/Window'
import Button from '../components/Button'
import StepList from '../components/StepList'
import { placeholders, policies } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import './content.css'

const TITLE = 'About the shop'

const STEPS = [
  { title: 'Designed', text: 'Each piece starts as a sketch and gets reworked until it feels right.' },
  { title: 'Made by hand', text: 'Made a few at a time, so small differences between pieces are normal.' },
  { title: 'Packed & shipped', text: `Packed by hand and shipped within ${policies.dispatchTime}.` },
]

export default function AboutPage() {
  usePageTitle(TITLE)

  return (
    <div className="content-page">
      <section className="about-intro" aria-labelledby="about-title">
        <Window title="me.jpg" className="about-photo">
          <div className="about-photo__placeholder sunken">{placeholders.workspacePhoto}</div>
        </Window>
        <div className="about-text">
          <h1 id="about-title" className="content-title rainbow-text">{TITLE}</h1>
          <p className="content-prose">
            We&apos;re {placeholders.ownerNames}, and this is our very small arts and crafts shop, run
            out of {placeholders.city}, BC.
          </p>
          <p className="content-prose">
            We make everything ourselves, by hand and in small batches. That means no two pieces are
            exactly alike, and when something sells out it might take a little while to come back.
          </p>
        </div>
      </section>

      <section className="about-how" aria-labelledby="how-title">
        <h2 id="how-title" className="content-section-title">How it&apos;s made</h2>
        <StepList steps={STEPS} className="content-steps" />
      </section>

      <Window title="Contact" className="about-contact">
        <div>
          <h2>Questions, custom orders, wholesale?</h2>
          <p>
            Email <a href={placeholders.emailHref}>{placeholders.email}</a> and we&apos;ll get back to
            you within {policies.replyTime}.
          </p>
        </div>
        <Button to="/">Shop now</Button>
      </Window>
    </div>
  )
}
