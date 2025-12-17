import { useEffect, useRef, useState } from "react";

const items = [
  { text: "Shower", prefix: "in Your" },
  { text: "Sauna", prefix: "in Your" },
  { text: "Bathtub", prefix: "in Your" },
  { text: "Commute", prefix: "from Your" },
  { text: "Dentist Chair", prefix: "from Your" },
  { text: "Hot Tub", prefix: "in Your" },
  { text: "Lunch Break", prefix: "on Your" },
  { text: "Hammock", prefix: "from Your" },
  { text: "Treehouse", prefix: "from Your" },
  { text: "Grocery Line", prefix: "from Your" },
];

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";

export const AnimatedHero = () => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState(items[0].text);
  const [displayPrefix, setDisplayPrefix] = useState(items[0].prefix);

  const prevTextRef = useRef(items[0].text);
  const prevPrefixRef = useRef(items[0].prefix);

  useEffect(() => {
    const targetText = items[index].text;
    const targetPrefix = items[index].prefix;

    const prevText = prevTextRef.current;
    const prevPrefix = prevPrefixRef.current;

    if (targetText === prevText && targetPrefix === prevPrefix) return;

    let progress = 0;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);

      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - (-2 * progress + 2) ** 2 / 2;

      const lenText = Math.floor(
        prevText.length + (targetText.length - prevText.length) * eased,
      );
      let resultText = "";
      for (let i = 0; i < lenText; i++) {
        if (i < eased * targetText.length) {
          resultText += targetText[i] || "";
        } else {
          resultText += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }

      let resultPrefix = targetPrefix;
      if (targetPrefix !== prevPrefix) {
        const lenPrefix = Math.floor(
          prevPrefix.length + (targetPrefix.length - prevPrefix.length) * eased,
        );
        resultPrefix = "";
        for (let i = 0; i < lenPrefix; i++) {
          if (i < eased * targetPrefix.length) {
            resultPrefix += targetPrefix[i] || "";
          } else {
            resultPrefix += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
      }

      setDisplayText(resultText);
      setDisplayPrefix(resultPrefix);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayText(targetText);
        setDisplayPrefix(targetPrefix);

        prevTextRef.current = targetText;
        prevPrefixRef.current = targetPrefix;
      }
    };

    requestAnimationFrame(animate);
  }, [index]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1 className="mb-8 text-4xl font-extrabold tracking-tight text-fd-foreground sm:text-5xl lg:text-6xl font-departure uppercase min-h-[3.6em] sm:min-h-[2.4em]">
      Use Opencode <br />
      <span className="inline-block">{displayPrefix}</span>{" "}
      <br className="block sm:hidden" />
      <span className="text-[#84cc16] inline-block relative min-h-[1.2em]">
        <span className="inline-block">{displayText}</span>
      </span>
    </h1>
  );
};
