import { BsWhatsapp } from "react-icons/bs";

const WhatsAppFloat = () => {
  const phoneNumber = "5676230885"; // apna number (91 ke sath)

  return (
    <a
      href={`https://wa.me/${phoneNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg flex items-center justify-center"
    >
      <BsWhatsapp size={28} />
    </a>
  );
};

export default WhatsAppFloat;
