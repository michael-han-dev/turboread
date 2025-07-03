import { basehub, getGlobalConfig } from "basehub";
import { RichText } from "basehub/react-rich-text";
import { sendEvent, parseFormData } from "basehub/events";
import { InputForm } from "@/components/waitlist-form";
import { WaitlistWrapper } from "@/components/box";
import { Metadata } from "next";
import "../basehub.config";

export const dynamic = "force-static";
export const revalidate = 30;

export const generateMetadata = async (): Promise<Metadata> => {
  const data = await basehub().query({
    settings: {
      metadata: {
        titleTemplate: true,
        defaultTitle: true,
        defaultDescription: true,
        favicon: {
          url: true,
        },
        ogImage: {
          url: true,
        },
      },
    },
  });
  return {
    title: {
      template: data.settings.metadata.titleTemplate,
      default: data.settings.metadata.defaultTitle,
    },
    description: data.settings.metadata.defaultDescription,
    openGraph: {
      type: "website",
      images: [data.settings.metadata.ogImage.url],
    },
    twitter: {
      card: "summary_large_image",
      images: [data.settings.metadata.ogImage.url],
    },
    icons: [data.settings.metadata.favicon.url],
  };
};

export default async function Home() {
  const { waitlist } = await basehub().query({
    waitlist: {
      title: true,
      subtitle: {
        json: {
          content: true,
        },
      },
      input: {
        ingestKey: true,
        schema: true,
      },
      button: {
        idleCopy: true,
        successCopy: true,
        submittingCopy: true,
      },
    },
  });

  const emailInput = waitlist.input.schema[0];
  if (!emailInput) {
    console.warn("No email input found");
  }

  return (
    <WaitlistWrapper>
      {/* Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-medium text-slate-12 whitespace-pre-wrap text-pretty">
          {waitlist.title}
        </h1>
        {waitlist.subtitle && (
          <div className="text-slate-10 [&>p]:tracking-tight text-pretty">
            <RichText content={waitlist.subtitle.json.content} />
          </div>
        )}
      </div>
      {/* Form */}
      <div className="px-1 flex flex-col w-full self-stretch">
        {emailInput && (
          <InputForm
            buttonCopy={{
              idle: waitlist.button.idleCopy,
              success: waitlist.button.successCopy,
              loading: waitlist.button.submittingCopy,
            }}
            formAction={async (data) => {
              "use server";
              try {
                const parsedData = parseFormData(
                  waitlist.input.ingestKey,
                  waitlist.input.schema,
                  data
                );
                if (!parsedData.success) {
                  console.error(parsedData.errors);
                  return {
                    success: false,
                    error:
                      parsedData.errors[emailInput.name] ||
                      Object.values(parsedData.errors)[0] ||
                      "Unknown error",
                  };
                }
                await sendEvent(waitlist.input.ingestKey, parsedData.data);
                return { success: true };
              } catch (error) {
                console.error(error);
                return {
                  success: false,
                  error: "There was an error while submitting the form",
                };
              }
            }}
            {...emailInput}
          />
        )}
      </div>
    </WaitlistWrapper>
  );
}
